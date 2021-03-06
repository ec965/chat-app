import * as React from 'react';
import { Center, useToast } from '@chakra-ui/react';
// token
import { decodeToJwtUser, saveToken } from '../api/token';
import { StoreContext } from '../store';
// form
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Auth from '../component/auth';
// user feedback action
import { Redirect } from 'react-router-dom';
import { ServerError, BadLogin, GoodLogin } from '../component/toast';
// API/ validators
import { AuthRequest } from '../api';
import { AuthData, TokenData, AuthValidator, TokenValidator} from '../api/validators/auth';
import * as t from 'io-ts';
import { pipe } from 'fp-ts/lib/pipeable';
import { fold } from 'fp-ts/lib/Either';

export const LoginPage: React.FC = () => {
  return (
    <Center>
      <LoginForm/>
    </Center>
  );  
}

const schema = yup.object().shape({
  email: yup.string().email("Please enter a valid email.").required("Email is required."),
  password: yup.string().required("Password is required.")
});

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

const LoginForm: React.FC = () => {
  const { handleSubmit, errors, register, formState } = useForm({
    resolver: yupResolver(schema)
  });

  const [formAccepted, setFormAccepted] = React.useState<boolean>(false);

  // use toast for error handling
  const toastMessage = useToast();
  
  const {storeDispatch} = React.useContext(StoreContext);

  const onSubmit = (data: LoginFormData): void =>{
    const rememberMe = data.rememberMe;
    // reformat data to post
    const postData = {
      email: data.email,
      password: data.password,
    };
    // post data

    AuthRequest.postLogin(postData)
      .then(res => res.data)
      .then(data => {
        const onTokenLeft = (errors: t.Errors): void => {
          const onNoTokenRight = (data: AuthData): void => {
            toastMessage(BadLogin(data.message));
          }
          const onNoTokenLeft = (errors: t.Errors): void => {
            console.error('Validation error at post login: ', errors);
          }

          console.error('NO TOKEN Validation error at post login: ', errors);
          pipe(AuthValidator.decode(data), fold(onNoTokenLeft, onNoTokenRight));
        }
        const onTokenRight = (data: TokenData): void => {
          const jwtUser = decodeToJwtUser(data.token);
          if(jwtUser){
            toastMessage(GoodLogin(data.message));
            saveToken(data.token, rememberMe);
            storeDispatch({type: 'store current user', payload: jwtUser});
            setTimeout(() => {setFormAccepted(true)}, 100);
          }
        }

        pipe(TokenValidator.decode(data), fold(onTokenLeft, onTokenRight));
      })
      .catch(error => {
        toastMessage(ServerError);
        console.error(error);
      });
  }

  // redirect link is currently a placeholder
  return(
    formAccepted
      ? <Redirect to="/chat/-1"/>
      :
      <Auth.Form 
        title="Login" 
        onSubmit={handleSubmit(onSubmit)}
        altLink="/register"
        linkText="Don't have an account?"
      >
        <Auth.EmailFormInput
          isInvalid={Boolean(errors.email)}
          register={register}
          errorMessage={errors.email?.message}
        />
        
        <Auth.PasswordFormInput
          isInvalid={Boolean(errors.password)}
          register={register}
          errorMessage={errors.password?.message}
        />

        <Auth.RememberMe register={register} />
        <Auth.Button
          isLoading={formState.isSubmitting}
          type="submit"
        >
          Submit
        </Auth.Button>
      </Auth.Form>
  );
}